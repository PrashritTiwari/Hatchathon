import { useState } from "react";
export default function Rating() {
  const [rating, setRating] = useState(null);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");


  const handleSubmit = async () => {
      const review_API = import.meta.env.VITE_REVIEW_API;
      
      if (!review_API) {
        console.error("VITE_REVIEW_API is not defined. Make sure it's set in your .env file and restart the dev server.");
        alert("API key not found. Please check your .env file and restart the dev server.");
        return;
      }
     
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${review_API}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `The user rated ${rating}/10 and said: "${reason}". Ask exactly ONE follow-up question. Do not add explanations, do not add multiple questions, and do not add extra text. Return only the question.`,
                  },
                ],
              },
            ],
          }),
        }
      );
      setReason("");

      const data = await res.json();

      const output =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response text found";
console.log(data)
      setText(output); // <-- FIX
    } catch (err) {
      console.error("Error:", err);
    }
  };

  return (
    <div className="text-center p-6 bg-blue-300">
      <h2 className="text-lg font-semibold mb-4">
        How likely are you to recommend us?
      </h2>

      <div className="text-sm flex justify-between mb-3">
        <span>Not at all likely</span>
        <span>Highly likely</span>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <button
            key={num}
            onClick={() => {
              setRating(num);
              setReason("");
            }}
            className={`
              w-10 h-10 flex items-center justify-center rounded-full 
              border text-base cursor-pointer
              ${
                rating === num
                  ? "border-gray-800 bg-gray-200"
                  : "border-gray-300 bg-white"
              }
            `}
          >
            {num}
          </button>
        ))}
      </div>

      {rating !== null && (
        <>
          <div className="mt-6">
            <p className="text-sm mb-2">Why did you choose {rating}?</p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full max-w-md mx-auto p-2 border rounded-md text-sm"
              placeholder="Type your reason here..."
            />

            <button
              onClick={handleSubmit}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition"
            >
              Submit
            </button>
          </div>
          <div className="mt-4 p-4 bg-white text-gray-800 rounded-xl shadow-md border border-gray-200 max-w-md mx-auto">
            {text}
          </div>
        </>
      )}
    </div>
  );
}
