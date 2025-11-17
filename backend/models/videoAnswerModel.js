import sql from '../database/db.js';

export async function createVideoAnswer({ interview_link_token, question_id, candidate_email, video_url, video_blob, recording_duration }) {
  if (!interview_link_token || !question_id || !candidate_email) {
    throw new Error('interview_link_token, question_id, and candidate_email are required');
  }

  // Use ON CONFLICT to update if exists
  const result = await sql`
    INSERT INTO video_answers (interview_link_token, question_id, candidate_email, video_url, video_blob, recording_duration)
    VALUES (${interview_link_token}, ${question_id}, ${candidate_email}, ${video_url || null}, ${video_blob || null}, ${recording_duration || null})
    ON CONFLICT (interview_link_token, question_id)
    DO UPDATE SET
      video_url = EXCLUDED.video_url,
      video_blob = EXCLUDED.video_blob,
      recording_duration = EXCLUDED.recording_duration,
      created_at = CURRENT_TIMESTAMP
    RETURNING id, interview_link_token, question_id, candidate_email, video_url, recording_duration, created_at
  `;

  return result[0];
}

export async function getVideoAnswersByToken(interview_link_token) {
  if (!interview_link_token) {
    throw new Error('interview_link_token is required');
  }

  const result = await sql`
    SELECT va.*, q.question_text, q.question_order
    FROM video_answers va
    JOIN questions q ON va.question_id = q.id
    WHERE va.interview_link_token = ${interview_link_token}
    ORDER BY q.question_order ASC
  `;

  return result;
}

export async function getVideoAnswerByTokenAndQuestion(interview_link_token, question_id) {
  if (!interview_link_token || !question_id) {
    throw new Error('interview_link_token and question_id are required');
  }

  const result = await sql`
    SELECT * FROM video_answers
    WHERE interview_link_token = ${interview_link_token} AND question_id = ${question_id}
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

// Get all responses for an interviewer (grouped by interview)
export async function getResponsesByInterviewer(interviewer_id, role_id = null, limit = null) {
  console.log('[getResponsesByInterviewer] Starting query', { interviewer_id, role_id, limit });
  const queryStartTime = Date.now();

  if (!interviewer_id) {
    throw new Error('interviewer_id is required');
  }

  let result;
  if (role_id) {
    console.log('[getResponsesByInterviewer] Filtering by specific role:', role_id);
    // Filter by specific role
    if (limit) {
      console.log('[getResponsesByInterviewer] Executing query with role filter and limit...');
      const sqlStartTime = Date.now();
      result = await sql`
        SELECT DISTINCT
          il.unique_token as interview_token,
          il.candidate_email,
          c.name as candidate_name,
          r.id as role_id,
          r.title as role_title,
          il.created_at as interview_created_at,
          MAX(va.created_at) as last_response_at,
          COUNT(va.id) as answer_count
        FROM interview_links il
        JOIN interviews i ON il.interview_id = i.id
        JOIN roles r ON i.role_id = r.id
        LEFT JOIN candidates c ON c.email = il.candidate_email AND c.role_id = r.id
        LEFT JOIN video_answers va ON va.interview_link_token = il.unique_token
        WHERE r.interviewer_id = ${interviewer_id}
          AND i.role_id = ${role_id}
          AND il.used = true
          AND va.id IS NOT NULL
        GROUP BY il.unique_token, il.candidate_email, c.name, r.id, r.title, il.created_at
        ORDER BY last_response_at DESC NULLS LAST, il.created_at DESC
        LIMIT ${limit}
      `;
      console.log(`[getResponsesByInterviewer] SQL query completed in ${Date.now() - sqlStartTime}ms`);
    } else {
      console.log('[getResponsesByInterviewer] Executing query with role filter (no limit)...');
      const sqlStartTime = Date.now();
      result = await sql`
        SELECT DISTINCT
          il.unique_token as interview_token,
          il.candidate_email,
          c.name as candidate_name,
          r.id as role_id,
          r.title as role_title,
          il.created_at as interview_created_at,
          MAX(va.created_at) as last_response_at,
          COUNT(va.id) as answer_count
        FROM interview_links il
        JOIN interviews i ON il.interview_id = i.id
        JOIN roles r ON i.role_id = r.id
        LEFT JOIN candidates c ON c.email = il.candidate_email AND c.role_id = r.id
        LEFT JOIN video_answers va ON va.interview_link_token = il.unique_token
        WHERE r.interviewer_id = ${interviewer_id}
          AND i.role_id = ${role_id}
          AND il.used = true
          AND va.id IS NOT NULL
        GROUP BY il.unique_token, il.candidate_email, c.name, r.id, r.title, il.created_at
        ORDER BY last_response_at DESC NULLS LAST, il.created_at DESC
      `;
      console.log(`[getResponsesByInterviewer] SQL query completed in ${Date.now() - sqlStartTime}ms`);
    }
  } else {
    console.log('[getResponsesByInterviewer] Getting all roles for interviewer');
    // Get all roles for interviewer
    if (limit) {
      console.log('[getResponsesByInterviewer] Executing query with limit (no role filter)...');
      const sqlStartTime = Date.now();
      result = await sql`
        SELECT DISTINCT
          il.unique_token as interview_token,
          il.candidate_email,
          c.name as candidate_name,
          r.id as role_id,
          r.title as role_title,
          il.created_at as interview_created_at,
          MAX(va.created_at) as last_response_at,
          COUNT(va.id) as answer_count
        FROM interview_links il
        JOIN interviews i ON il.interview_id = i.id
        JOIN roles r ON i.role_id = r.id
        LEFT JOIN candidates c ON c.email = il.candidate_email AND c.role_id = r.id
        LEFT JOIN video_answers va ON va.interview_link_token = il.unique_token
        WHERE r.interviewer_id = ${interviewer_id}
          AND il.used = true
          AND va.id IS NOT NULL
        GROUP BY il.unique_token, il.candidate_email, c.name, r.id, r.title, il.created_at
        ORDER BY last_response_at DESC NULLS LAST, il.created_at DESC
        LIMIT ${limit}
      `;
      console.log(`[getResponsesByInterviewer] SQL query completed in ${Date.now() - sqlStartTime}ms`);
    } else {
      console.log('[getResponsesByInterviewer] Executing query without limit or role filter...');
      const sqlStartTime = Date.now();
      result = await sql`
        SELECT DISTINCT
          il.unique_token as interview_token,
          il.candidate_email,
          c.name as candidate_name,
          r.id as role_id,
          r.title as role_title,
          il.created_at as interview_created_at,
          MAX(va.created_at) as last_response_at,
          COUNT(va.id) as answer_count
        FROM interview_links il
        JOIN interviews i ON il.interview_id = i.id
        JOIN roles r ON i.role_id = r.id
        LEFT JOIN candidates c ON c.email = il.candidate_email AND c.role_id = r.id
        LEFT JOIN video_answers va ON va.interview_link_token = il.unique_token
        WHERE r.interviewer_id = ${interviewer_id}
          AND il.used = true
          AND va.id IS NOT NULL
        GROUP BY il.unique_token, il.candidate_email, c.name, r.id, r.title, il.created_at
        ORDER BY last_response_at DESC NULLS LAST, il.created_at DESC
      `;
      console.log(`[getResponsesByInterviewer] SQL query completed in ${Date.now() - sqlStartTime}ms`);
    }
  }

  const totalTime = Date.now() - queryStartTime;
  console.log(`[getResponsesByInterviewer] Total function time: ${totalTime}ms, returning ${result.length} results`);
  return result;
}

// Get all video answers for a specific interview (for stitching)
export async function getVideoAnswersForStitching(interview_token) {
  console.log('[getVideoAnswersForStitching] Fetching video answers for token:', interview_token);
  
  if (!interview_token) {
    throw new Error('interview_token is required');
  }

  const queryStartTime = Date.now();
  // First get the role_id for this interview
  const interviewInfo = await sql`
    SELECT i.role_id
    FROM interview_links il
    JOIN interviews i ON il.interview_id = i.id
    WHERE il.unique_token = ${interview_token}
    LIMIT 1
  `;
  
  const roleId = interviewInfo.length > 0 ? interviewInfo[0].role_id : null;
  
  const result = await sql`
    SELECT 
      va.id,
      va.interview_link_token,
      va.question_id,
      va.candidate_email,
      va.video_url,
      va.video_blob,
      va.recording_duration,
      va.created_at,
      q.question_text,
      q.question_order,
      c.name as candidate_name
    FROM video_answers va
    JOIN questions q ON va.question_id = q.id
    LEFT JOIN candidates c ON c.email = va.candidate_email AND c.role_id = ${roleId}
    WHERE va.interview_link_token = ${interview_token}
    ORDER BY q.question_order ASC, va.id ASC
  `;

  const queryTime = Date.now() - queryStartTime;
  console.log(`[getVideoAnswersForStitching] Query completed in ${queryTime}ms, found ${result.length} answers`);
  console.log(`[getVideoAnswersForStitching] Role ID used for candidate join: ${roleId}`);
  
  // Check for duplicates
  const uniqueIds = new Set(result.map(r => r.id));
  const uniqueQuestionIds = new Set(result.map(r => r.question_id));
  console.log(`[getVideoAnswersForStitching] Unique answer IDs: ${uniqueIds.size}, Unique question IDs: ${uniqueQuestionIds.size}`);
  
  if (result.length !== uniqueIds.size) {
    console.warn(`[getVideoAnswersForStitching] WARNING: Found ${result.length} rows but only ${uniqueIds.size} unique IDs!`);
  }
  
  console.log('[getVideoAnswersForStitching] Answer details:', result.map(r => ({
    id: r.id,
    question_id: r.question_id,
    question_order: r.question_order,
    question_text: r.question_text?.substring(0, 30),
    video_url: r.video_url ? r.video_url.substring(0, 50) + '...' : 'null',
    interview_link_token: r.interview_link_token,
    candidate_name: r.candidate_name
  })));

  return result;
}

// Add this function to store stitched video URL
export async function saveStitchedVideoUrl(interview_token, stitched_url) {
  if (!interview_token || !stitched_url) {
    throw new Error('interview_token and stitched_url are required');
  }

  try {
    // Store in interview_links table
    const result = await sql`
      UPDATE interview_links
      SET stitched_video_url = ${stitched_url},
          stitched_at = CURRENT_TIMESTAMP
      WHERE unique_token = ${interview_token}
      RETURNING unique_token, stitched_video_url, stitched_at
    `;

    return result[0];
  } catch (error) {
    console.error('[saveStitchedVideoUrl] Error:', error);
    throw error;
  }
}

// Add this function to get stitched video URL
export async function getStitchedVideoUrl(interview_token) {
  if (!interview_token) {
    throw new Error('interview_token is required');
  }

  try {
    const result = await sql`
      SELECT stitched_video_url, stitched_at
      FROM interview_links
      WHERE unique_token = ${interview_token}
      LIMIT 1
    `;

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[getStitchedVideoUrl] Error:', error);
    throw error;
  }
}