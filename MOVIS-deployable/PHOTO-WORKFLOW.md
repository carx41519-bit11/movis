# Photograph workflow

Photo capture is Android only. Choose incoming stock or complete count, capture/select a still photograph, inspect visible detections, correct registered item quantities and confirm explicitly.

Incoming quantities add to stock; they never replace the existing location total. A complete count requires the complete physical item/location total and a confirmation checkbox, then records verified minus recorded quantity. Hidden items cannot be reliably detected. A single partial photograph is not evidence of a complete warehouse count.

Retries use stable request keys; committed scans cannot switch purposes. Return suitability confirmation is separate and each return restocks once. See defense/ARCHITECTURE.md and defense/USER-GUIDE.md. Demo results are synthetic; real inference requires trusted tested weights.
