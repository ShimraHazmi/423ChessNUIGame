import django
from django.conf import settings
from django.urls import path
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import whisper, tempfile, os, sys

settings.configure(
    DEBUG=True,
    SECRET_KEY="local-whisper-server-secret",
    ALLOWED_HOSTS=["*"],
    ROOT_URLCONF=__name__,
)

print("Loading Whisper model...")
model = whisper.load_model("base")  # change to "tiny" for faster startup
print("Whisper model ready.")

@csrf_exempt
def transcribe(request):
    if request.method == "OPTIONS":
        response = JsonResponse({})
    elif request.method == "POST":
        audio = request.FILES.get("file")
        if not audio:
            response = JsonResponse({"error": "No file provided"}, status=400)
        else:
            try:
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                    for chunk in audio.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name
                result = model.transcribe(tmp_path)
                os.unlink(tmp_path)
                response = JsonResponse({"text": result["text"]})
            except Exception as e:
                response = JsonResponse({"error": str(e)}, status=500)
    else:
        response = JsonResponse({"error": "Method not allowed"}, status=405)

    # CORS headers so the browser can call this from localhost:3000
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response

urlpatterns = [path("transcribe", transcribe)]

if __name__ == "__main__":
    sys.argv = ["whisper_server.py", "runserver", "5000", "--noreload"]
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
