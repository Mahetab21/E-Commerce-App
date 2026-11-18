import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  Length,
} from 'class-validator';
export class GoogleOAuthDto {
  @IsString() @IsNotEmpty() idToken: string;
  @IsOptional() @IsString() @Length(2, 30) firstName?: string;
  @IsOptional() @IsString() @Length(2, 30) lastName?: string;
  @IsOptional() @IsInt() @Min(18) @Max(100) age?: number;
}
