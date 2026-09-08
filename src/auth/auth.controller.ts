import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  JsonResponse,
  ResponseHelper,
} from '@miguelcazares/nestjs-response-helper';
import { AuthService } from 'src/auth/auth.service';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import { AuthResponseDto, PublicUserDto } from 'src/auth/dto/auth-response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthSwagger } from 'src/auth/swagger/auth.swagger';

@ApiTags('Auth')
@Controller('/api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Alta del usuario propietario (solo si la tabla está vacía)',
  })
  @AuthSwagger.Register()
  async register(
    @Body() dto: RegisterDto,
  ): Promise<JsonResponse<AuthResponseDto>> {
    const result = await this.authService.register(dto);
    return ResponseHelper.jsendSuccess(result, HttpStatus.CREATED);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y devuelve el JWT' })
  @AuthSwagger.Login()
  async login(@Body() dto: LoginDto): Promise<JsonResponse<AuthResponseDto>> {
    const result = await this.authService.login(dto);
    return ResponseHelper.jsendSuccess(result);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Devuelve el usuario del token' })
  @AuthSwagger.Me()
  me(@CurrentUser() user: UserEntity): JsonResponse<PublicUserDto> {
    return ResponseHelper.jsendSuccess(this.authService.toPublicUser(user));
  }

  @Patch('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Actualiza nombre, zona horaria o el chat de Telegram',
  })
  async updateProfile(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateProfileDto,
  ): Promise<JsonResponse<PublicUserDto>> {
    const result = await this.authService.updateProfile(user.id, dto);
    return ResponseHelper.jsendSuccess(result);
  }
}
