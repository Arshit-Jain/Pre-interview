const users = [];
let nextId = 1;

export function findUserByEmail(email) {
  return users.find(user => user.email === email);
}

export function findUserById(id) {
  return users.find(user => user.id === id);
}

export function createUser({ username, email, password = null, provider = 'local', providerId = null }) {
  const user = {
    id: nextId++,
    username,
    email,
    password,
    provider,
    providerId,
    createdAt: new Date()
  };
  users.push(user);
  return user;
}

export function findOrCreateOAuthUser({ email, username, provider, providerId }) {
  let user = users.find(
    existing =>
      existing.email === email || (existing.provider === provider && existing.providerId === providerId)
  );

  if (user) {
    if (!user.provider) {
      user.provider = provider;
    }
    if (!user.providerId) {
      user.providerId = providerId;
    }
    if (!user.username) {
      user.username = username;
    }
    return user;
  }

  user = createUser({
    username,
    email,
    provider,
    providerId
  });

  return user;
}

export function getPublicUser(user) {
  if (!user) return null;
  const { password, ...publicUser } = user;
  return publicUser;
}

export function resetUsers() {
  users.length = 0;
  nextId = 1;
}

export default {
  findUserByEmail,
  findUserById,
  findOrCreateOAuthUser,
  createUser,
  getPublicUser,
  resetUsers
};

