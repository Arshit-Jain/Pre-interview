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

CREATE TABLE interview_links (
  id SERIAL PRIMARY KEY,
  candidate_email VARCHAR(150) NOT NULL,
  interview_id INT REFERENCES interviews(id) ON DELETE CASCADE,
  unique_token UUID DEFAULT gen_random_uuid() UNIQUE,  -- unique random identifier
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
  used BOOLEAN DEFAULT FALSE
);