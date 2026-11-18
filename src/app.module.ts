import { validateEnvironment } from './config/environment';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './module/user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { S3Service } from './common/services';
import { BrandModule } from './module/brand/brand.module';
import { CategoryModule } from './module/category/category.module';
import { subCategoryModule } from './module/subCategory/subCategory.module';
import { ProductModule } from './module/Product/product.module';
import { CartModule } from './module/Cart/cart.module';
import { CouponModule } from './module/Coupon/coupon.module';
import { OrderModule } from './module/order/order.module';
import { GatewayModule } from './module/gateway/gateway.module';
import { CacheModule } from '@nestjs/cache-manager';
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', 'config/.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URI as string, {
      onConnectionCreate: (connection: Connection) => {
        connection.on('connected', () => console.log('Database connected'));
        return connection;
      },
    }),
    GatewayModule,
    UserModule,
    BrandModule,
    CategoryModule,
    subCategoryModule,
    ProductModule,
    CartModule,
    CouponModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [AppService, S3Service],
})
export class AppModule {}
