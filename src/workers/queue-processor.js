export default {
  async fetch(request, env) {
    return new Response("Queue processor running");
  },
  
  async queue(batch, env) {
    for (const message of batch.messages) {
      const data = JSON.parse(message.body);
      
      // Process meeting recording
      if (data.type === 'PROCESS_RECORDING') {
        await processRecording(data.meetingId, env);
      }
      
      // Track AI usage
      if (data.type === 'TRACK_AI_USAGE') {
        await trackAIUsage(data.usage, env);
      }
    }
    
    return batch.ackAll();
  }
};

async function processRecording(meetingId, env) {
  // 1. Fetch meeting details from DB
  const meeting = await env.DB.prepare(
    "SELECT * FROM meetings WHERE id = ?"
  ).bind(meetingId).first();
  
  // 2. Download recording from R2
  const recording = await env.RECORDINGS.get(`recordings/${meetingId}.mp4`);
  
  // 3. Upload to transcription service (simulated)
  const transcriptionId = await submitForTranscription(recording);
  
  // 4. Update meeting status
  await env.DB.prepare(
    "UPDATE meetings SET status = ? WHERE id = ?"
  ).bind("TRANSCRIBING", meetingId).run();
  
  // 5. Cache the transcription ID
  await env.MEETING_CACHE.put(`transcription:${meetingId}`, transcriptionId, {
    expirationTtl: 86400 // 24 hours
  });
}

async function submitForTranscription(recording) {
  // Simulate submitting to a transcription service
  return "sim-transcription-" + Math.random().toString(36).substring(2, 10);
}

async function trackAIUsage(usage, env) {
  // Store AI usage analytics
  const { userId, tokens, model, timestamp } = usage;
  
  // In a real implementation, you would store this in Analytics Engine
  console.log(`User ${userId} used ${tokens} tokens with ${model}`);
}
