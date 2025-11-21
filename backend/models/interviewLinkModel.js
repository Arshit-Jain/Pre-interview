import sql from '../database/db.js';

export async function createInterviewLink({ candidate_email, interview_id, expires_in_days = 7 }) {
  if (!candidate_email || !interview_id) {
    throw new Error('candidate_email and interview_id are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(candidate_email)) {
    throw new Error('Invalid email address format');
  }

  let final_days = Number(expires_in_days);
  if (isNaN(final_days) || final_days <= 0) {
    final_days = 7; // Force default if input is invalid
  }

  // Fix: Use PostgreSQL's interval multiplication instead of string interpolation
  const result = await sql`
    INSERT INTO interview_links (candidate_email, interview_id, expires_at)
    VALUES (
      ${candidate_email.trim()}, 
      ${interview_id},
      CURRENT_TIMESTAMP + (INTERVAL '1 day' * ${final_days})
    )
    RETURNING id, candidate_email, interview_id, unique_token, expires_at, used, created_at
  `;

  return result[0];
}

export async function getInterviewLinkByToken(token) {
  if (!token) {
    throw new Error('Token is required');
  }

  // Try to get link with interview, role, and interviewer info
  try {
    const result = await sql`
      SELECT 
        il.*, 
        i.role_id, 
        r.title as role_title,
        int.email as interviewer_email,
        int.name as interviewer_name
      FROM interview_links il
      JOIN interviews i ON il.interview_id = i.id
      JOIN roles r ON i.role_id = r.id
      LEFT JOIN interviewers int ON r.interviewer_id = int.id
      WHERE il.unique_token = ${token}
      LIMIT 1
    `;

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error in getInterviewLinkByToken:', error);
    // Fallback if table structure implies different relationships
    try {
      const result = await sql`
        SELECT il.*
        FROM interview_links il
        WHERE il.unique_token = ${token}
        LIMIT 1
      `;

      if (result.length > 0) {
        // Try to fetch basic role info if possible, ignoring interviewer for fallback
        try {
          const roleInfo = await sql`
            SELECT r.id as role_id, r.title as role_title
            FROM interviews i
            JOIN roles r ON i.role_id = r.id
            WHERE i.id = ${result[0].interview_id}
            LIMIT 1
          `;
          return { ...result[0], ...roleInfo[0] };
        } catch {
          return result[0];
        }
      }
      return null;
    } catch (fallbackError) {
       console.error('Fallback error in getInterviewLinkByToken:', fallbackError);
       return null;
    }
  }
}

export async function validateInterviewLink(token) {
  const link = await getInterviewLinkByToken(token);

  if (!link) {
    throw new Error('Invalid interview link');
  }

  if (link.used) {
    throw new Error('This interview link has already been used');
  }

  const now = new Date();
  const expiresAt = new Date(link.expires_at);

  if (now > expiresAt) {
    throw new Error('This interview link has expired');
  }

  return link;
}

// Validate link but allow used links (for fetching questions after marking as used)
export async function validateInterviewLinkAllowUsed(token) {
  const link = await getInterviewLinkByToken(token);

  if (!link) {
    throw new Error('Invalid interview link');
  }

  const now = new Date();
  const expiresAt = new Date(link.expires_at);

  if (now > expiresAt) {
    throw new Error('This interview link has expired');
  }

  return link;
}

export async function markLinkAsUsed(token) {
  if (!token) {
    throw new Error('Token is required');
  }

  const result = await sql`
    UPDATE interview_links
    SET used = true
    WHERE unique_token = ${token}
    RETURNING id, candidate_email, interview_id, unique_token, expires_at, used
  `;

  if (result.length === 0) {
    throw new Error('Interview link not found');
  }

  return result[0];
}

export async function getInterviewLinksByInterview(interview_id) {
  if (!interview_id) {
    throw new Error('interview_id is required');
  }

  const result = await sql`
    SELECT il.*, c.name as candidate_name
    FROM interview_links il
    LEFT JOIN candidates c ON il.candidate_email = c.email AND c.role_id = (SELECT role_id FROM interviews WHERE id = ${interview_id})
    WHERE il.interview_id = ${interview_id}
    ORDER BY il.created_at DESC
  `;

  return result;
}