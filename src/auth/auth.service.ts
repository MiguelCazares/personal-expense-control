import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from 'src/auth/entities/user.entity';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { AuthResponseDto, PublicUserDto } from 'src/auth/dto/auth-response.dto';
import { JwtPayload } from 'src/auth/dto/jwt-payload.interface';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';
import { assignDefined } from 'src/common/utils/assign-defined.util';
import { JwtExpiresIn } from 'src/config/jwt.config';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly expiresIn: JwtExpiresIn;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.expiresIn = configService.get<JwtExpiresIn>('jwt.expiresIn', '90d');
  }

  /**
   * El proyecto es mono-usuario: el registro queda abierto solo mientras la
   * tabla está vacía, para dar de alta al dueño en el primer arranque. Después
   * se cierra solo, así el endpoint no queda como puerta abierta en producción.
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.userRepository.count();
    if (existing > 0) {
      throw new ForbiddenException(
        'El registro está cerrado: ya existe un usuario propietario',
      );
    }

    const user = await this.userRepository.save(
      this.userRepository.create({
        email: dto.email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        name: dto.name,
        timezone: dto.timezone ?? 'America/Mexico_City',
      }),
    );

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        telegramChatId: true,
        isActive: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    // Se compara siempre contra un hash — aunque el usuario no exista — para no
    // filtrar por tiempo de respuesta qué correos están dados de alta.
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const matches = await bcrypt.compare(dto.password, hash);

    if (!user || !matches || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.buildAuthResponse(user);
  }

  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<PublicUserDto> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException('Token inválido');

    // La zona no se valida contra una lista: Intl ya rechaza una zona inventada
    // al primer uso, y mejor fallar aquí que en el cron de alertas.
    if (dto.timezone) this.assertTimezoneIsValid(dto.timezone);

    assignDefined(user, dto);
    await this.userRepository.save(user);

    return this.toPublicUser(user);
  }

  private assertTimezoneIsValid(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    } catch {
      throw new BadRequestException(`Zona horaria inválida: ${timezone}`);
    }
  }

  /** Usado por JwtStrategy para resolver el token a un usuario vigente. */
  async findActiveById(id: number): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id, isActive: true } });
  }

  toPublicUser(user: UserEntity): PublicUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      telegramChatId: user.telegramChatId ?? null,
      createdAt: user.createdAt,
    };
  }

  private buildAuthResponse(user: UserEntity): AuthResponseDto {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: this.expiresIn,
      }),
      user: this.toPublicUser(user),
    };
  }

  private dummyHash(): Promise<string> {
    return bcrypt.hash('dummy-password', BCRYPT_ROUNDS);
  }
}
