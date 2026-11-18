import { AppController } from './app.controller';
describe('Health', () => {
  it('returns service status without private configuration', () => {
    expect(new AppController().getHello()).toEqual({
      name: 'E-Commerce API',
      status: 'ok',
    });
  });
});
