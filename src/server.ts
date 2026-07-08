//import dotenv from "dotenv";
//dotenv.config();
import app from "./app";
import { ENV } from "./config/env";
import { connectDB } from "./config/db";

const port = ENV.PORT || "5001";

async function start() { 
    await connectDB();

    app.listen(port, () => {
        console.log(`Server listening at ${port}`);
    });
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
