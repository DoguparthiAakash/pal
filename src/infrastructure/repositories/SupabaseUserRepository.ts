import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { UserRepository } from '@/domain/interfaces';
import { User } from '@/domain/entities';
import { config } from '@/config';

export class SupabaseUserRepository implements UserRepository {
  private supabase;

  constructor() {
    this.supabase = supabase;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as User;
  }

  async upsert(user: User): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .upsert(user)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert user: ${error.message}`);
    }
    return data as User;
  }
}
