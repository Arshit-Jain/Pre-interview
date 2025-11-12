import sql from '../database/db.js';

// Assuming we need an interviews table that links roles to interviews
// This creates a relationship: Role -> Interview -> Interview Links

export async function getOrCreateInterview(role_id) {
  if (!role_id) {
    throw new Error('role_id is required');
  }

  // Check if interview exists for this role
  const existing = await sql`
    SELECT id, role_id FROM interviews WHERE role_id = ${role_id} LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0];
  }

  // Create a new interview for this role
  const result = await sql`
    INSERT INTO interviews (role_id)
    VALUES (${role_id})
    RETURNING id, role_id
  `;

  return result[0];
}

export async function getInterviewByRole(role_id) {
  if (!role_id) {
    throw new Error('role_id is required');
  }

  const result = await sql`
    SELECT i.*, r.title as role_title
    FROM interviews i
    JOIN roles r ON i.role_id = r.id
    WHERE i.role_id = ${role_id}
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

