import { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
    Controller,
    BadRequestException,
    Body,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Req,
    Res,
    UnauthorizedException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
    DeleteUserHwidDeviceCommand,
    GetUserHwidDevicesCommand,
    GetUserByUsernameCommand,
} from '@remnawave/backend-contract';

import { AxiosService } from '@common/axios';
import { ClientIp } from '@common/decorators/get-ip';

const deviceId = (hwid: string) => createHash('sha256').update(hwid).digest('hex');

@Controller('api/devices')
export class DevicesController {
    constructor(
        private readonly jwt: JwtService,
        private readonly panel: AxiosService,
    ) {}

    @Get()
    async list(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
        @ClientIp() ip: string,
    ) {
        return this.devices(request, response, ip);
    }

    @Delete()
    async remove(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
        @ClientIp() ip: string,
        @Body() body: unknown,
    ) {
        const parsed = z
            .object({ id: z.string().regex(/^[a-f0-9]{64}$/) })
            .strict()
            .safeParse(body);
        if (!parsed.success) {
            throw new BadRequestException('A device identifier is required.');
        }
        return this.devices(request, response, ip, parsed.data.id);
    }

    private async devices(request: Request, response: Response, ip: string, id?: string) {
        response.setHeader('Cache-Control', 'no-store');
        let shortUuid: string;
        try {
            const token = request.cookies?.device_session;
            if (typeof token !== 'string') throw new Error('Missing session');
            const claims = this.jwt.verify<{ sub: string }>(token, {
                audience: 'subscription-devices',
                algorithms: ['HS256'],
            });
            if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('Invalid subject');
            // Another tab may have opened a different subscription on this host.
            if (request.headers['x-subscription-id'] !== claims.sub) throw new Error('Wrong page');
            shortUuid = claims.sub;
        } catch {
            throw new UnauthorizedException('Reload your subscription page to view devices.');
        }
        try {
            const subscription = await this.panel.getSubscriptionInfo(ip, shortUuid);
            if (!subscription.isOk || !subscription.response?.response.isFound)
                throw new Error('Subscription unavailable');
            const owner = await this.panel.getUserByUsername(
                ip,
                subscription.response.response.user.username,
            );
            if (!owner.isOk || !owner.response) throw new Error('Owner unavailable');
            const user = GetUserByUsernameCommand.ResponseSchema.parse(owner.response).response;
            // Never trust an identifier supplied by the browser, and re-check revoked links.
            if (user.shortUuid !== shortUuid) throw new Error('Subscription changed');
            const result = await this.panel.axiosInstance.get(
                GetUserHwidDevicesCommand.url(String(user.id)),
            );
            let data = GetUserHwidDevicesCommand.ResponseSchema.parse(result.data).response;
            if (data.devices.some((device) => device.userId !== user.id)) {
                throw new Error('Device owner mismatch');
            }
            if (id !== undefined) {
                const device = data.devices.find((device) => deviceId(device.hwid) === id);
                if (!device) {
                    // The global NotFoundException filter closes sockets for unknown routes.
                    throw new HttpException('Device not found.', HttpStatus.NOT_FOUND);
                }
                const deleted = await this.panel.axiosInstance.post(
                    DeleteUserHwidDeviceCommand.url,
                    { userId: user.id, hwid: device.hwid },
                );
                data = DeleteUserHwidDeviceCommand.ResponseSchema.parse(deleted.data).response;
                if (data.devices.some((device) => device.userId !== user.id)) {
                    throw new Error('Device owner mismatch');
                }
            }
            return {
                total: data.total,
                limit: user.hwidDeviceLimit,
                devices: data.devices.map((device) => ({
                    id: deviceId(device.hwid),
                    platform: device.platform,
                    osVersion: device.osVersion,
                    deviceModel: device.deviceModel,
                    createdAt: device.createdAt,
                    updatedAt: device.updatedAt,
                })),
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new ServiceUnavailableException(
                'Device request unavailable. Please retry or contact support.',
            );
        }
    }
}
