import sql from '../database/db.js';

export async function createRole({ id, interviewer_id, title }) {
  if (!interviewer_id || !title) {
    throw new Error('interviewer_id and title are required');
  }

  if (title.length > 150) {
    throw new Error('Title must be 150 characters or less');
  }

  // Verify that the interviewer exists
  const interviewer = await sql`
    SELECT id FROM interviewers WHERE id = ${interviewer_id}
  `;

  if (interviewer.length === 0) {
    throw new Error('Interviewer not found');
  }

  // If ID is provided, check if it already exists
  if (id !== undefined && id !== null) {
    const roleId = Number(id);
    
    console.log('Creating role with explicit ID:', roleId);
    
    const existingRole = await sql`
      SELECT id FROM roles WHERE id = ${roleId}
    `;

    if (existingRole.length > 0) {
      throw new Error('Role ID already exists');
    }

    // Insert the role with specified ID
    // PostgreSQL SERIAL columns accept explicit values when provided
    const result = await sql`
      INSERT INTO roles (id, interviewer_id, title)
      VALUES (${roleId}, ${interviewer_id}, ${title})
      RETURNING id, interviewer_id, title, created_at
    `;

    console.log('Role created with ID:', result[0]?.id);

    // Update the sequence to prevent conflicts with future auto-generated IDs
    try {
      const maxId = await sql`
        SELECT MAX(id) as max_id FROM roles
      `;
      const nextId = (maxId[0]?.max_id || 0) + 1;
      
      // Try to update the sequence - use the standard naming convention
      await sql`
        SELECT setval('roles_id_seq', ${nextId}, false)
      `.catch(async () => {
        // If that fails, try using pg_get_serial_sequence
        try {
          await sql`
            SELECT setval(pg_get_serial_sequence('roles', 'id'), ${nextId}, false)
          `;
        } catch (e) {
          console.warn('Could not update sequence:', e.message);
        }
      });
    } catch (seqError) {
      // If sequence update fails, continue anyway - the insert was successful
      console.warn('Sequence update warning:', seqError.message);
    }

    return result[0];
  } else {
    // Insert the role without ID (use SERIAL)
    const result = await sql`
      INSERT INTO roles (interviewer_id, title)
      VALUES (${interviewer_id}, ${title})
      RETURNING id, interviewer_id, title, created_at
    `;

    return result[0];
  }
}

export async function getRolesByInterviewer(interviewer_id) {
  if (!interviewer_id) {
    throw new Error('interviewer_id is required');
  }

  const result = await sql`
    SELECT id, interviewer_id, title, created_at
    FROM roles
    WHERE interviewer_id = ${interviewer_id}
    ORDER BY created_at DESC
  `;

  return result;
}

export async function getAllRoles() {
  const result = await sql`
    SELECT r.id, r.interviewer_id, r.title, r.created_at, i.name as interviewer_name, i.email as interviewer_email
    FROM roles r
    JOIN interviewers i ON r.interviewer_id = i.id
    ORDER BY r.created_at DESC
  `;

  return result;
}

