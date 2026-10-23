import path from 'path';

export const DATA_DIRECTORY = process.env.DATA_DIRECTORY?.trim() || path.join(__dirname, '..', 'data');
export const UPLOAD_DIRECTORY = path.join(DATA_DIRECTORY, 'uploads');