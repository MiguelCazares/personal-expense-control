import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from 'src/auth/auth.service';
import { UserEntity } from 'src/auth/entities/user.entity';
import { JwtPayload } from 'src/auth/dto/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  // Se relee el usuario en cada request en vez de confiar en el payload: así
  // desactivar la cuenta invalida los tokens vivos sin esperar a que expiren.
  async validate(payload: JwtPayload): Promise<UserEntity> {
    const user = await this.authService.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException('Token inválido');
    return user;
  }
}
