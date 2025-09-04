import { MongoClient, Db } from 'mongodb';

// MongoDB connection configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'test';

// Create a singleton MongoDB client
class MongoDBManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<void> {
    if (!this.client) {
      this.client = new MongoClient(MONGO_URI);
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }
}

export const mongoManager = new MongoDBManager();

// MongoDB tool functions
export async function listCollections(): Promise<string[]> {
  try {
    await mongoManager.connect();
    const db = mongoManager.getDb();
    const collections = await db.listCollections().toArray();
    return collections.map(collection => collection.name);
  } catch (error) {
    throw new Error(`Failed to list collections: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function createCollection(collectionName: string): Promise<string> {
  try {
    await mongoManager.connect();
    const db = mongoManager.getDb();
    
    // Check if collection already exists
    const existingCollections = await listCollections();
    if (existingCollections.includes(collectionName)) {
      return `Collection '${collectionName}' already exists`;
    }
    
    // Create the collection
    await db.createCollection(collectionName);
    return `Collection '${collectionName}' created successfully`;
  } catch (error) {
    throw new Error(`Failed to create collection '${collectionName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function dropCollection(collectionName: string): Promise<string> {
  try {
    await mongoManager.connect();
    const db = mongoManager.getDb();
    
    // Check if collection exists
    const existingCollections = await listCollections();
    if (!existingCollections.includes(collectionName)) {
      return `Collection '${collectionName}' does not exist`;
    }
    
    // Drop the collection
    await db.dropCollection(collectionName);
    return `Collection '${collectionName}' dropped successfully`;
  } catch (error) {
    throw new Error(`Failed to drop collection '${collectionName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Cleanup function to close connections
export async function cleanup(): Promise<void> {
  await mongoManager.disconnect();
}