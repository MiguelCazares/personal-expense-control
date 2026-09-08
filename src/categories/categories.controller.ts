import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  JsonResponse,
  ResponseHelper,
} from '@miguelcazares/nestjs-response-helper';
import { CategoriesService } from 'src/categories/categories.service';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { CreateCategoryDto } from 'src/categories/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/categories/dto/update-category.dto';
import { FilterCategoryDto } from 'src/categories/dto/filter-category.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination-response.dto';
import { UserId } from 'src/common/decorators/user-id.decorator';
import { CategoriesSwagger } from 'src/categories/swagger/categories.swagger';

@ApiTags('Categories')
@ApiBearerAuth('bearer')
@Controller('/api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Crea una categoría' })
  @CategoriesSwagger.Create()
  async create(
    @UserId() userId: number,
    @Body() dto: CreateCategoryDto,
  ): Promise<JsonResponse<CategoryEntity>> {
    const result = await this.categoriesService.create(userId, dto);
    return ResponseHelper.jsendSuccess(result, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'Lista las categorías del usuario' })
  @CategoriesSwagger.FindAll()
  async findAll(
    @UserId() userId: number,
    @Query() filter: FilterCategoryDto,
  ): Promise<JsonResponse<PaginatedResponseDto<CategoryEntity>>> {
    const result = await this.categoriesService.paginate(userId, filter);
    return ResponseHelper.jsendSuccess(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Devuelve una categoría por id' })
  @CategoriesSwagger.FindOne()
  async findOne(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<JsonResponse<CategoryEntity>> {
    const result = await this.categoriesService.findOne(userId, id);
    return ResponseHelper.jsendSuccess(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza o archiva una categoría' })
  @CategoriesSwagger.Update()
  async update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<JsonResponse<CategoryEntity>> {
    const result = await this.categoriesService.update(userId, id, dto);
    return ResponseHelper.jsendSuccess(result);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra una categoría que no tenga movimientos' })
  @CategoriesSwagger.Remove()
  async remove(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.categoriesService.remove(userId, id);
  }
}
