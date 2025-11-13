import { Request, Response } from "express";
import { ScriptProducer } from "../producers/script.producer";

const producer = new ScriptProducer();

export class ScriptsController {
  public handleLessonsCancelledScript = async (
      req: Request,
      res: Response
  ): Promise<void> => {
    try {
      const { branchId,jobId } = req.body;

      // Log the incoming webhook data
      console.log("📥 Received webhook pabbly processing request:");

      // Validate that we have the necessary data
      if (!branchId) {
        res.status(400).json({
          status: "error",
          message: "Missing required data: branchId is required",
        });
        return;
      }

      const scriptPayload = {
        jobId,
        branchId,
      };

      // Use the producer to queue the invoice job
      await producer.produceScriptJob(scriptPayload);

      // Acknowledge receipt of the webhook immediately
      res.status(200).json({
        message: "Processing job queued successfully",
      });
    } catch (error) {
      console.error("❌ Error processing request:", error);
      res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
  };
}
