import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Miguel', maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({
    example: 'America/Mexico_City',
    description: 'Zona IANA; define el mes en curso y la hora de las alertas.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    example: '123456789',
    description:
      'Chat de Telegram al que van las alertas. Escríbele al bot y léelo en https://api.telegram.org/bot<TOKEN>/getUpdates',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramChatId?: string;
}
