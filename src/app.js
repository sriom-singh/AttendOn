import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import assignmentsRoute from "./routes/assignmentsRoute.js";
import attendAggregationRoute from "./routes/attendAggregationRoute.js";
import courseRoutes from "./routes/courseRoutes.js";
import departmenteRoutes from "./routes/department.js";
import orgainizationRoutes from "./routes/orgainization.js";
import sectionRoutes from "./routes/sectionRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import adminRoutes from "./routes/admin.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173/", // ❗ exact frontend URL
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/student", studentRoutes, attendAggregationRoute);
app.use("/api/admin", adminRoutes);
app.use("/api/assignments", assignmentsRoute);
app.use("/api/courses", courseRoutes);
app.use("/api/department", departmenteRoutes);
app.use("/api/organization", orgainizationRoutes);
app.use("/api/section", sectionRoutes);
app.use("/api/subject", subjectRoutes, assignmentsRoute);
app.use("/api/subjectAssignment", assignmentsRoute);

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

export default app;
