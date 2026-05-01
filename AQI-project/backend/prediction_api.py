from flask import Flask, request, jsonify
from flask_cors import CORS
from prediction.predict import predict_both_stations

app = Flask(__name__)
CORS(app)

@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.json

    result = predict_both_stations(
        industrial_data=data["industrial"],
        forest_data=data["forest"]
    )

    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True, port=5001)