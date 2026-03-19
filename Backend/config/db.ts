import mongoose from 'mongoose';

const RETRY_DELAY_MS = 5000;

const connectDB = async (): Promise<void> => {
  const uri = `${process.env.MONGODB_URI || 'mongodb://localhost:27017'}/${process.env.DB_NAME || 'nextfit'}`;
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log(`Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000}s...`);
    setTimeout(() => {
      void connectDB();
    }, RETRY_DELAY_MS);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB error:', error);
});

export default connectDB;