from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from models.database import db
from models.sensor_reading import SensorReading
from routes.sensor_routes import sensor_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    app.register_blueprint(sensor_bp)

    @app.route("/")
    def home():
        return jsonify({
            "message": "AQI Flask backend is running"
        })

    return app

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("Database tables created!")

    app.run(debug=True)