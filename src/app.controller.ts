import { Controller, Get } from '@nestjs/common';
@Controller()
export class AppController {
  @Get() getHello() {
    return { name: 'E-Commerce API', status: 'ok' };
  }
}
