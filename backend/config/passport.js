const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { query } = require('./database');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const result = await query(
      'SELECT id, email, full_name, role, profile_picture FROM users WHERE id = $1',
      [id]
    );
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const result = await query(
          'SELECT * FROM users WHERE email = $1',
          [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        const user = result.rows[0];

        if (!user.password) {
          return done(null, false, { 
            message: 'Please sign in with Google' 
          });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        let result = await query(
          'SELECT * FROM users WHERE google_id = $1',
          [profile.id]
        );

        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        }

        // Check if user exists with same email
        result = await query(
          'SELECT * FROM users WHERE email = $1',
          [profile.emails[0].value.toLowerCase()]
        );

        if (result.rows.length > 0) {
          // Link Google account to existing user
          const updateResult = await query(
            'UPDATE users SET google_id = $1, profile_picture = $2 WHERE id = $3 RETURNING *',
            [profile.id, profile.photos[0].value, result.rows[0].id]
          );
          return done(null, updateResult.rows[0]);
        }

        // Create new user - default to student role
        const newUserResult = await query(
          `INSERT INTO users (email, full_name, google_id, profile_picture, role) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [
            profile.emails[0].value.toLowerCase(),
            profile.displayName,
            profile.id,
            profile.photos[0].value,
            'student'
          ]
        );

        return done(null, newUserResult.rows[0]);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;