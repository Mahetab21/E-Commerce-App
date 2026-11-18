process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.TEST_MONGO_URI ||
  'mongodb://127.0.0.1:27017/ecommerce_test?replicaSet=rs0';
process.env.ACCESS_TOKEN_USER ||= 'test-user-access-only-not-a-real-secret';
process.env.ACCESS_TOKEN_ADMIN ||= 'test-admin-access-only-not-a-real-secret';
process.env.REFRESH_TOKEN_USER ||= 'test-user-refresh-only-not-a-real-secret';
process.env.REFRESH_TOKEN_ADMIN ||= 'test-admin-refresh-only-not-a-real-secret';
process.env.BEARER_USER ||= 'Bearer';
process.env.BEARER_ADMIN ||= 'Admin';
process.env.SALT_ROUND = '4';
