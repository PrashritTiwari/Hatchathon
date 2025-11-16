import { useState } from "react";
export default function Rating() {
  const [rating, setRating] = useState(null);
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    try {
      const res = await fetch("http://demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, reason }),
      });

      const data = await res.json();
      console.log("API response:", data);
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
        {[0,1,2,3,4,5,6,7,8,9,10].map((num) => (
          <button
            key={num}
            onClick={() => {
              setRating(num);
              setReason("");
            }}
            className={`
              w-10 h-10 flex items-center justify-center rounded-full 
              border text-base cursor-pointer
              ${rating === num 
                ? "border-gray-800 bg-gray-200" 
                : "border-gray-300 bg-white"}
            `}
          >
            {num}
          </button>
        ))}
      </div>

      {rating !== null && (
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
      )}
    </div>
  );
}
