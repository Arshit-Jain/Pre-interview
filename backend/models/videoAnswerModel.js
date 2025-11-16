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

