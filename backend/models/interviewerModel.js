import sql from '../database/db.js';

export async function findInterviewerByEmail(email) {
  if (!email) return null;

  const result = await sql`
    SELECT id, name, email, password_hash, created_at
    FROM interviewers
    WHERE email = ${email}
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

export async function ensureInterviewerExists({ email, name }) {
  if (!email) {
    throw new Error('Email is required to ensure interviewer exists');
  }

  const existing = await findInterviewerByEmail(email);
  if (existing) {
    if (name && existing.name !== name) {
      await sql`
        UPDATE interviewers
        SET name = ${name}
        WHERE id = ${existing.id}
      `;
      return { ...existing, name };
    }
    return existing;
  }

  const displayName = name || email.split('@')[0];

  const inserted = await sql`
    INSERT INTO interviewers (name, email, password_hash)
    VALUES (${displayName}, ${email}, null)
    RETURNING id, name, email, created_at
  `;

  return inserted[0];
}


