import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to_email, from_name, message } = req.body;

  if (!to_email || !from_name || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // 🔒 EmailJS credentials (move these to environment vars later)
  const EMAILJS_SERVICE_ID = "service_2a2ye9s";
  const EMAILJS_TEMPLATE_ID = "template_tvd3iv9";
  const EMAILJS_PUBLIC_KEY = "yivsGi1tzi_-4fiw8";

  try {
    const response = await axios.post("https://api.emailjs.com/api/v1.0/email/send", {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email,
        from_name,
        message,
      },
    });

    console.log("✅ EmailJS response:", response.data);
    return res.status(200).json({ success: true, data: response.data });
  } catch (err) {
    console.error("❌ EmailJS error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
