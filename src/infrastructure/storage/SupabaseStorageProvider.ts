import { createClient } from '@supabase/supabase-js';
import { StorageProvider } from '@/domain/interfaces';
import { config } from '@/config';

export class SupabaseStorageProvider implements StorageProvider {
  private supabase;
  private bucketName = 'documents';

  constructor() {
    // We use the service role key for backend operations because RLS 
    // is enforced at the database level for table access, but for 
    // the private bucket, the backend acts as a trusted orchestrator.
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  }

  async uploadFile(path: string, file: Buffer | Blob): Promise<{ path: string; url: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, file, {
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return {
      path: data.path,
      url: `${config.supabase.url}/storage/v1/object/public/${this.bucketName}/${data.path}`
    };
  }

  async downloadFile(path: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(path);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(path: string, expiresInSeconds: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }
}
