CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    interviewer_id INT REFERENCES interviewers(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE interviewers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_order INT NOT NULL CHECK (question_order BETWEEN 1 AND 10),
    created_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE candidates (
    id SERIAL PRIMARY KEY,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    submitted BOOLEAN DEFAULT FALSE,
    CONSTRAINT unique_candidate_per_role UNIQUE (role_id, email)
);

CREATE TABLE interviews (
  id SERIAL PRIMARY KEY,
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interview_links (
  id SERIAL PRIMARY KEY,
  candidate_email VARCHAR(150) NOT NULL,
  interview_id INT REFERENCES interviews(id) ON DELETE CASCADE,
  unique_token UUID DEFAULT gen_random_uuid() UNIQUE,  -- unique random identifier
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
  used BOOLEAN DEFAULT FALSE
);

CREATE TABLE video_answers (
  id SERIAL PRIMARY KEY,
  interview_link_token UUID REFERENCES interview_links(unique_token) ON DELETE CASCADE,
  question_id INT REFERENCES questions(id) ON DELETE CASCADE,
  candidate_email VARCHAR(150) NOT NULL,
  video_url TEXT,
  video_blob BYTEA,
  recording_duration INT, -- duration in seconds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(interview_link_token, question_id)
);