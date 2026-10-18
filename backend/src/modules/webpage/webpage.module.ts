import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { getJWTConfig } from '@common/config/jwt/jwt.config';

import { DevicesController } from './devices.controller';
import { WebpageController } from './webpage.controller';
import { WebpageService } from './webpage.service';

@Module({
    imports: [JwtModule.registerAsync(getJWTConfig())],
    controllers: [WebpageController, DevicesController],
    providers: [WebpageService],
    exports: [WebpageService],
})
export class WebpageModule {}
