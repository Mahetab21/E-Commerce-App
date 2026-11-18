import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Types } from 'mongoose';

@ValidatorConstraint({ name: 'IdsMongo', async: false })
export class IdsMongo implements ValidatorConstraintInterface {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validate(ids: string[], args: ValidationArguments) {
    // Handle cases where ids might not be an array
    if (!ids) return true; // Let @IsOptional handle empty values
    if (!Array.isArray(ids)) return false; // Invalid if not an array

    // Check if every ID in the array is a valid MongoDB ObjectId
    return ids.filter((id) => Types.ObjectId.isValid(id)).length === ids.length;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultMessage(args: ValidationArguments) {
    return `All provided IDs must be valid MongoDB ObjectIds`;
  }
}
