import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './module/user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AuthModule } from './module/auth/auth.module';
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
      envFilePath: 'config/.env',
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URI as string, {
      onConnectionCreate: (connection: Connection) => {
        connection.on('connected', () =>
          console.log(`DB connected successfully on ${process.env.MONGO_URI}`),
        );
        return connection;
      },
    }),
    GatewayModule,
    UserModule,
    AuthModule,
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
