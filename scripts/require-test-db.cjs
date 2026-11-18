if (!process.env.TEST_MONGO_URI) {
  console.error(
    'Set TEST_MONGO_URI to a dedicated disposable MongoDB replica-set database before running integration tests.',
  );
  process.exit(1);
}
