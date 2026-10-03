# Train MOVIS when warehouse items are available

After connecting trained weights, Analyze photo runs YOLO on one submitted image. Review/edit the quantities, then optionally add NEW incoming units. Photo additions increase current stock; they do not replace the total with a photo count. See ../PHOTO-WORKFLOW.md for the current flow.

The shipped demo scanner does not analyze photos. It generates two sample boxes for up to two registered item classes. No trained model, labeled warehouse dataset, accuracy result, or test result for real detection is supplied.

## 1. Choose recognizable item classes

Start with a small set of visually distinguishable products (proposed starting point: 3–5 classes). Define the unit of counting: one bottle, one carton, or one sealed box. Avoid mixing carton counts with units inside cartons. Similar packaging may require a barcode check or manual identification; those are future features, not implemented here.

Create the actual items in Android > Manage. Use stable class labels such as `water_bottle_500ml` in both the item catalog and dataset YAML. Labels must match exactly. Existing names, SKUs, and model-class mappings can be edited. Use a fresh real database instead of the seeded demo database.

## 2. Collect and label real photos

Obtain warehouse permission to photograph inventory. Capture different phones, lighting conditions, shelf heights, distances, backgrounds, and arrangements. Include empty shelves and confusing objects. A proposed starting target is several hundred diverse images per class; this is a collection target, not a guarantee of accuracy. Expand based on held-out errors.

Use an annotation tool that exports YOLO detection labels. Draw one bounding box around each visible counting unit. Define consistent rules for partial objects. Do not label fully hidden units as visible detections. Record physical ground-truth counts separately for whole-location reconciliation.

Label format for each image's `.txt` file:

```text
class_id center_x center_y width height
```

Coordinates are normalized to the image size. An empty label file represents an image with no target objects.

```text
warehouse_dataset/
  images/train/  images/val/  images/test/
  labels/train/  labels/val/  labels/test/
```

Split by capture session/shelf/day before augmentation (proposed 70% train, 15% validation, 15% test). Adjacent burst photos must remain in the same split. Keep the test split untouched while selecting confidence thresholds and model settings.

## 3. Train and validate

Copy `dataset.yaml.example` to `dataset.yaml`. Replace the placeholder class names, set an absolute dataset path, and remove unused class entries. Install the inference/training dependency in a separate Python environment:

```powershell
python -m pip install "ultralytics>=8.3,<9"
python train.py --data dataset.yaml --base yolo26n.pt --epochs 50 --device cpu
```

The first use of pretrained weights may download them. CPU training may be slow; train on a compatible GPU or an approved hosted notebook if available. Review the chosen model's licensing before distributing the system. The small pretrained model is a proposed starting point; the warehouse test results should determine the final model.

After training, run held-out evaluation with the resulting weights:

```powershell
yolo detect val model=runs/movis/weights/best.pt data=dataset.yaml split=test
```

Record class-level precision, recall, and mAP, plus counting mean absolute error and exact-count accuracy per item/photo. Compare visible-object ground truth separately from physical counts that include hidden stock. Measure cold and warm inference time on the actual server. Report failures by lighting, distance, overlap, and item class. No results should be written until measured.

## 4. Switch the backend to real inference

Copy the selected `best.pt` into a local model folder. Register all model labels in the real catalog, then start the backend:

```powershell
python server.py --db real.db --host 0.0.0.0 --mode yolo --weights ..\models\best.pt
```

Missing weights cause startup to fail; there is no fallback to fake detections. Unmapped labels appear in the Android results but cannot automatically become inventory items. Verification forms cover registered stock at the selected location, including zero detections. Physically count units outside the image before confirming a location total. Only confirmation creates an adjustment.

Official references: [Ultralytics training](https://docs.ultralytics.com/modes/train/), [prediction](https://docs.ultralytics.com/modes/predict/), and [detection](https://docs.ultralytics.com/tasks/detect/).
