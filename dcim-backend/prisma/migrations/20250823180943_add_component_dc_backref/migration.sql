/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Datacenter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[model,vendor,function]` on the table `PhysicalComponentModel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[manufacturer,modelRef]` on the table `RackModel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Datacenter_name_key" ON "public"."Datacenter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalComponentModel_model_vendor_function_key" ON "public"."PhysicalComponentModel"("model", "vendor", "function");

-- CreateIndex
CREATE UNIQUE INDEX "RackModel_manufacturer_modelRef_key" ON "public"."RackModel"("manufacturer", "modelRef");
