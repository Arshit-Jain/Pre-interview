import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import {
  findUserById,
  findOrCreateOAuthUser,
  getPublicUser
} from '../models/userStore.js';
import { ensureInterviewerExists } from '../models/interviewerModel.js';

dotenv.config();

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  BACKEND_URL
} = process.env;

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = findUserById(id);
  done(null, user || false);
});

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️  Google OAuth credentials are not set. Google login will be unavailable.');
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL || 'http://localhost:3000'}/api/auth/oauth/google/callback`
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email associated with this Google account'));
          }

          const username =
            profile.displayName ||
            profile.name?.givenName ||
            profile.name?.familyName ||
            email.split('@')[0];

          try {
            await ensureInterviewerExists({
              email,
              name: username
            });
          } catch (dbError) {
            console.error('Failed to ensure interviewer exists in database:', dbError);
          }

          const user = findOrCreateOAuthUser({
            email,
            username,
            provider: 'google',
            providerId: profile.id
          });

          done(null, getPublicUser(user));
        } catch (error) {
          done(error);
        }
      }
    )
  );
}

