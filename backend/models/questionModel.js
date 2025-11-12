import sql from '../database/db.js';

export async function createQuestion({ role_id, question_text, question_order }) {
  if (!role_id || !question_text || !question_order) {
    throw new Error('role_id, question_text, and question_order are required');
  }

  if (question_order < 1 || question_order > 10) {
    throw new Error('question_order must be between 1 and 10');
  }

  // Verify that the role exists
  const role = await sql`
    SELECT id FROM roles WHERE id = ${role_id}
  `;

  if (role.length === 0) {
    throw new Error('Role not found');
  }

  // Check current question count for this role
  const currentCount = await sql`
    SELECT COUNT(*) as count FROM questions WHERE role_id = ${role_id}
  `;

  if (currentCount[0].count >= 10) {
    throw new Error('Maximum of 10 questions allowed per role');
  }

  // Insert the question
  const result = await sql`
    INSERT INTO questions (role_id, question_text, question_order)
    VALUES (${role_id}, ${question_text.trim()}, ${question_order})
    RETURNING id, role_id, question_text, question_order, created_at
  `;

  return result[0];
}

export async function getQuestionsByRole(role_id) {
  if (!role_id) {
    throw new Error('role_id is required');
  }

  const result = await sql`
    SELECT id, role_id, question_text, question_order, created_at
    FROM questions
    WHERE role_id = ${role_id}
    ORDER BY question_order ASC
  `;

  return result;
}

export async function updateQuestionOrder(question_id, new_order) {
  if (!question_id || !new_order) {
    throw new Error('question_id and new_order are required');
  }

  if (new_order < 1 || new_order > 10) {
    throw new Error('question_order must be between 1 and 10');
  }

  const result = await sql`
    UPDATE questions
    SET question_order = ${new_order}
    WHERE id = ${question_id}
    RETURNING id, role_id, question_text, question_order, created_at
  `;

  if (result.length === 0) {
    throw new Error('Question not found');
  }

  return result[0];
}

export async function updateQuestion(question_id, question_text) {
  if (!question_id || !question_text) {
    throw new Error('question_id and question_text are required');
  }

  const result = await sql`
    UPDATE questions
    SET question_text = ${question_text.trim()}
    WHERE id = ${question_id}
    RETURNING id, role_id, question_text, question_order, created_at
  `;

  if (result.length === 0) {
    throw new Error('Question not found');
  }

  return result[0];
}

export async function deleteQuestion(question_id) {
  if (!question_id) {
    throw new Error('question_id is required');
  }

  const result = await sql`
    DELETE FROM questions
    WHERE id = ${question_id}
    RETURNING id
  `;

  if (result.length === 0) {
    throw new Error('Question not found');
  }

  return result[0];
}

export async function reorderQuestions(role_id, question_orders) {
  // question_orders is an array of { question_id, question_order }
  if (!role_id || !Array.isArray(question_orders)) {
    throw new Error('role_id and question_orders array are required');
  }

  // Update all questions in a transaction
  const updates = question_orders.map(({ question_id, question_order }) =>
    sql`
      UPDATE questions
      SET question_order = ${question_order}
      WHERE id = ${question_id} AND role_id = ${role_id}
    `
  );

  await Promise.all(updates);

  // Return updated questions
  return getQuestionsByRole(role_id);
}

