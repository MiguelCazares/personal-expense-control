import { ApiProperty } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'miguel@example.com' })
  email: string;

  @ApiProperty({ example: 'Miguel' })
  name: string;

  @ApiProperty({ example: 'America/Mexico_City' })
  timezone: string;

  @ApiProperty({ example: null, nullable: true })
  telegramChatId: string | null;

  @ApiProperty({ example: '2026-09-08T18:00:00.000Z' })
  createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT firmado; se manda como `Authorization: Bearer <token>`.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({ type: PublicUserDto })
  user: PublicUserDto;
}
