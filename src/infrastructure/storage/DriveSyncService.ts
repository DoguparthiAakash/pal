export class DriveSyncService {
  /**
   * Check if a file exists in the user's Google Drive with the specified name.
   */
  async checkFileExists(fileName: string, accessToken: string): Promise<boolean> {
    try {
      const query = `name='${fileName}' and trashed=false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error('Failed to check file existence in Drive:', await response.text());
        return false;
      }
      
      const data = await response.json();
      return data.files && data.files.length > 0;
    } catch (error) {
      console.error('Error checking Drive file existence:', error);
      return false;
    }
  }

  /**
   * Upload a file to Google Drive using multipart upload.
   */
  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, accessToken: string): Promise<boolean> {
    try {
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: fileName,
        mimeType: mimeType
      };

      const multipartRequestBody = Buffer.concat([
        Buffer.from(
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${mimeType}\r\n\r\n`
        ),
        fileBuffer,
        Buffer.from(closeDelimiter)
      ]);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartRequestBody.length.toString()
        },
        body: multipartRequestBody as unknown as BodyInit // fetch types can be finicky with Buffers
      });

      if (!response.ok) {
        console.error('Failed to upload file to Drive:', await response.text());
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error uploading file to Drive:', error);
      return false;
    }
  }
}
