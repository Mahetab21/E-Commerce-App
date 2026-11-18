import { Model, ClientSession } from 'mongoose';
import {
  HydratedDocument,
  ProjectionType,
  QueryOptions,
  RootFilterQuery,
  UpdateQuery,
  UpdateWriteOpResult,
  DeleteResult,
} from 'mongoose';

export class DBRepository<TDocument> {
  constructor(protected readonly model: Model<TDocument>) {}
  async create(
    data: Partial<TDocument>,
    session?: ClientSession,
  ): Promise<HydratedDocument<TDocument>> {
    if (session) return (await this.model.create([data], { session }))[0];
    return this.model.create(data);
  }
  async findOne(
    filter: RootFilterQuery<TDocument>,
    select?: ProjectionType<TDocument>,
    options?: QueryOptions<TDocument>,
  ): Promise<HydratedDocument<TDocument> | null> {
    if (filter && Object.prototype.hasOwnProperty.call(filter, 'filter'))
      throw new Error('findOne requires a direct MongoDB filter');
    return this.model.findOne(filter, select, options);
  }
  async find({
    filter,
    select,
    options,
  }: {
    filter: RootFilterQuery<TDocument>;
    select?: ProjectionType<TDocument>;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument>[]> {
    return this.model.find(filter, select, options);
  }

  async updateOne(
    filter: RootFilterQuery<TDocument>,
    updated: UpdateQuery<TDocument>,
  ): Promise<UpdateWriteOpResult> {
    return await this.model.updateOne(filter, updated);
  }
  async findOneAndUpdate({
    filter,
    update,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options,
  }: {
    filter: RootFilterQuery<TDocument>;
    update: UpdateQuery<TDocument>;
    options?: QueryOptions<TDocument>;
  }): Promise<HydratedDocument<TDocument> | null> {
    return await this.model.findOneAndUpdate(filter, update, {
      new: true,
      runValidators: true,
      ...options,
    });
  }
  async deleteOne(filter: RootFilterQuery<TDocument>): Promise<DeleteResult> {
    return await this.model.deleteOne(filter);
  }
  async paginate({
    filter,
    query,
    projection,
    options,
  }: {
    filter: RootFilterQuery<TDocument>;
    query: { page: number; limit: number };
    projection?: ProjectionType<TDocument>;
    options?: QueryOptions<TDocument>;
  }) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(query.limit) || 20)),
    );
    const finalOptions = { ...options, skip: (page - 1) * limit, limit };
    const count = await this.model.countDocuments(filter);
    const numberOfPages = Math.ceil(count / limit);
    const docs = await this.model.find(filter, projection, finalOptions);
    return { docs, currentPage: page, countDocument: count, numberOfPages };
  }
  async findOneAndDelete(
    filter: RootFilterQuery<TDocument>,
    options?: QueryOptions<TDocument>,
  ): Promise<HydratedDocument<TDocument> | null> {
    return await this.model.findOneAndDelete(filter, options);
  }
  async deleteMany(
    filter: RootFilterQuery<TDocument>,
  ): Promise<{ deletedCount?: number }> {
    return await this.model.deleteMany(filter);
  }
  async findById(
    id: string,
    select?: ProjectionType<TDocument>,
    options?: QueryOptions<TDocument>,
  ): Promise<HydratedDocument<TDocument> | null> {
    return await this.model.findById(id, select, options);
  }
}
