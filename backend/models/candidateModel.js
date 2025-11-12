import sql from '../database/db.js';

export async function createCandidate({ role_id, name, email }) {
  if (!role_id || !name || !email) {
    throw new Error('role_id, name, and email are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email address format');
  }

  // Verify that the role exists
  const role = await sql`
    SELECT id FROM roles WHERE id = ${role_id}
  `;

  if (role.length === 0) {
    throw new Error('Role not found');
  }

  // Check if candidate already exists for this role
  const existing = await sql`
    SELECT id FROM candidates 
    WHERE role_id = ${role_id} AND email = ${email}
  `;

  if (existing.length > 0) {
    throw new Error('Candidate with this email already exists for this role');
  }

  // Insert the candidate
  const result = await sql`
    INSERT INTO candidates (role_id, name, email)
    VALUES (${role_id}, ${name.trim()}, ${email.trim()})
    RETURNING id, role_id, name, email, submitted, (SELECT title FROM roles WHERE id = ${role_id}) as role_title
  `;

  return result[0];
}

export async function getCandidateByEmailAndRole(role_id, email) {
  if (!role_id || !email) {
    throw new Error('role_id and email are required');
  }

  const result = await sql`
    SELECT c.*, r.title as role_title
    FROM candidates c
    JOIN roles r ON c.role_id = r.id
    WHERE c.role_id = ${role_id} AND c.email = ${email}
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

export async function getCandidatesByRole(role_id) {
  if (!role_id) {
    throw new Error('role_id is required');
  }

  const result = await sql`
    SELECT c.*, r.title as role_title
    FROM candidates c
    JOIN roles r ON c.role_id = r.id
    WHERE c.role_id = ${role_id}
    ORDER BY c.id DESC
  `;

  return result;
}

export async function updateCandidateSubmission(candidate_id, submitted = true) {
  if (!candidate_id) {
    throw new Error('candidate_id is required');
  }

  const result = await sql`
    UPDATE candidates
    SET submitted = ${submitted}
    WHERE id = ${candidate_id}
    RETURNING id, role_id, name, email, submitted
  `;

  if (result.length === 0) {
    throw new Error('Candidate not found');
  }

  return result[0];
}

