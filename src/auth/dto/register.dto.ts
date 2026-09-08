import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'miguel@example.com', maxLength: 180 })
  @IsEmail()
  @MaxLength(180)
  email: string;

  @ApiProperty({ example: 'una-contraseña-larga', minLength: 8, maxLength: 72 })
  @IsString()
  @IsNotEmpty()
  // 72 es el límite real de bcrypt: más allá los bytes se ignoran en silencio.
  @Length(8, 72)
  password: string;

  @ApiProperty({ example: 'Miguel', maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({
    description: 'Zona horaria IANA usada para calcular los vencimientos.',
    example: 'America/Mexico_City',
    default: 'America/Mexico_City',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
