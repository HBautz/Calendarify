import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class UserStateService {
  private dir = join(__dirname, '..', '..', 'data');

  async load(userId: string): Promise<any> {
    try {
      const content = await fs.readFile(join(this.dir, `${userId}.json`), 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return {};
    }
  }

  async save(userId: string, data: any) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(
      join(this.dir, `${userId}.json`),
      JSON.stringify(data, null, 2),
      'utf8',
    );
  }
}
