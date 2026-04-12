import django
from django.conf import settings
from django.urls import path, re_path
from django.http import JsonResponse, HttpResponse, HttpResponseForbidden, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from pathlib import Path
import mimetypes
import whisper, tempfile, os, sys

settings.configure(
    DEBUG=True,
    SECRET_KEY="local-whisper-server-secret",
    ALLOWED_HOSTS=["*"],
    ROOT_URLCONF=__name__,
)

print("Loading Whisper model...")
model = whisper.load_model("small") # oginally base
print("Whisper model ready.")

PROJECT_ROOT = Path(__file__).resolve().parent

@csrf_exempt
def transcribe(request):
    if request.method == "OPTIONS":
        response = JsonResponse({})
    elif request.method == "POST":
        audio = request.FILES.get("file")
        if not audio:
            response = JsonResponse({"error": "No file provided"}, status=400)
        else:
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                    for chunk in audio.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name
                
                file_size = os.path.getsize(tmp_path)
                print(f"\n=== Transcription Request ===")
                print(f"Audio file: {tmp_path}")
                print(f"File size: {file_size} bytes")
                
                result = model.transcribe(tmp_path, fp16=False)
                
                print(f"✓ Transcription: '{result['text']}'")
                response = JsonResponse({"text": result["text"]})
                
            except Exception as e:
                print(f"\n✗ TRANSCRIPTION ERROR:")
                print(f"  Type: {type(e).__name__}")
                print(f"  Message: {str(e)}")
                import traceback
                traceback.print_exc()
                response = JsonResponse({"error": str(e)}, status=500)
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except:
                        pass
    else:
        response = JsonResponse({"error": "Method not allowed"}, status=405)

    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response

def _resolve_path(path_fragment):
    target = (PROJECT_ROOT / path_fragment.lstrip("/")).resolve()
    try:
        target.relative_to(PROJECT_ROOT)
    except ValueError:
        return None
    return target


def serve_frontend(request, path=""):
    target = _resolve_path(path)
    if target is None:
        return HttpResponseForbidden("Invalid path")

    if path in ("", "/") or target.is_dir():
        target = PROJECT_ROOT / "index.html"

    if not target.exists() or not target.is_file():
        return HttpResponseNotFound("Not found")

    content_type, _ = mimetypes.guess_type(str(target))
    with open(target, "rb") as f:
        response = HttpResponse(
            f.read(),
            content_type=content_type or "application/octet-stream"
        )
    if target.suffix in {".js", ".mjs"}:
        response["Content-Type"] = "application/javascript"

    return response


urlpatterns = [
    path("transcribe", transcribe),
    re_path(r"^(?P<path>.*)$", serve_frontend),
]

if __name__ == "__main__":
    sys.argv = ["whisper_server.py", "runserver", "5000", "--noreload"]
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

# Credits:
# OpenAI Whisper - Speech recognition model
# https://github.com/openai/whisper
# Radford, A., Kim, J.W., Xu, T., Brockman, G., McLeavey, C., & Sutskever, I. (2022).
# "Robust Speech Recognition via Large-Scale Weak Supervision."
# Licensed under MIT License