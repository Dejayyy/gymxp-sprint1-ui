import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import os
import tqdm
import pandas as pd
import numpy as np
import regex as re
import random
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score, recall_score, precision_score
import math
import torch.utils.data as data_utils

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

dataset = pd.read_csv('./data/gxp_dataset_v4.csv')

workouts_cleaned = []
filt2 = r"\d"
filt5 = r"\."
filt3 = r"\(.*?\)"
filt4 = r"\-"
filt1 = r"[ ]{2,}"
filt6 = r"s/^\s+|\s+$|\s+(?=\s)//g"
filt7 = r"\s+$"

for workouts in dataset['suggested_workout']:
    workouts = re.sub(filt2, "", workouts)
    workouts = re.sub(filt5, "", workouts)
    workouts = re.sub(filt3, "", workouts)
    workouts = re.sub(filt4, "", workouts)
    workouts = re.sub(filt1, "", workouts)
    workouts = re.sub(filt6, "", workouts)
    workouts = re.sub(filt7, "", workouts)

    workouts = workouts.lower()
    workouts = workouts.splitlines()
    workouts_cleaned.append(workouts)

# Removing problematic user values
drop_list = []
for i,val in enumerate(workouts_cleaned):
    if len(val) != 10:
        #print(len(val))
        drop_list.append(i)

df_cleaned = dataset.drop(index=drop_list)
df_cleaned.reset_index(drop=True, inplace=True) # Resetting index

# Removing problematic workout values
workouts_cleaned = [val for idx, val in enumerate(workouts_cleaned) if idx not in drop_list]

# Flatten list to determine unique exercises compiled:
flat_workouts = []
for routine in workouts_cleaned:
    for exercise in routine:
        flat_workouts.append(exercise)

# List of Unique workouts
temp_df = pd.DataFrame(flat_workouts, columns=['Workouts'])
exercise_list = temp_df['Workouts'].unique()

# Adding new column for cleaned workouts
df_cleaned['suggested_workout_cleaned'] = workouts_cleaned

cleaned = False
try:
    df_cleaned = df_cleaned.drop(columns=['suggested_workout'])
    cleaned = True
except:
    cleaned = True

# Creating embeddings for each user
embedding = []
for workout in df_cleaned['suggested_workout_cleaned']:
    temp_embedding = []
    for exercise in exercise_list:
        if exercise in workout:
            temp_embedding.append(1)
        else:
            temp_embedding.append(0)
    embedding.append(temp_embedding)


df_cleaned['wo_embedding'] = embedding

# Cleaning customer name age fn and ln
cust_filt = r"(?<=:\s).*"
cust_filt_sex = r"(?<=\bsex\b).*"
cust_filt_quotes= r"['\"]"

cust_data = []
for cust in df_cleaned['customer']:
    cust_temp = []
    temp_cust = cust.split(',')
    cust_age = re.findall(cust_filt, temp_cust[0])
    cust_fn = re.findall(cust_filt, temp_cust[6])
    cust_ln = re.findall(cust_filt, temp_cust[7])
    cust_sex = re.findall(cust_filt_sex, cust)

    cust_temp.append(int(cust_age[0]))
    cust_temp.append(cust_fn[0])
    cust_temp.append(cust_ln[0])
    cust_temp.append(cust_sex[0][4])

    cust_data.append(cust_temp)

df_cust = pd.DataFrame(cust_data, columns= ['age', 'first_name', 'last_name', 'sex'])

df_cleaned['age'] = df_cust['age']
df_cleaned['first_name'] = df_cust['first_name']
df_cleaned['last_name'] = df_cust['last_name']
df_cleaned['sex'] = df_cust['sex']

# Dropping unnecessary columns
df_cleaned = df_cleaned.drop(columns=['customer'])

# raw customer dataset
raw_train, raw_test_val = train_test_split(df_cleaned, test_size=0.3, random_state=42)
raw_test, raw_val = train_test_split(raw_test_val, test_size=0.5, random_state=42)

# Test data
raw_test.to_csv('./data/test_data_init.csv', index=False)

def drop_ohe_cols(df):
    temp_df = df.drop(['completion rate', 'history', 'diet', 'suggested_workout_cleaned', 'seriousness', 'time_commitment'], axis = 1)
    return pd.get_dummies(temp_df,columns=['experience_level', 'equipment', 'goals', 'bodypart1', 'bodypart2', 'sex'], dtype=float)

X_train = drop_ohe_cols(raw_train)
X_test = drop_ohe_cols(raw_test)
X_val = drop_ohe_cols(raw_val)

def label_tensor(labels):
    temp_list = []
    for val in labels:
        temp_list.append(torch.tensor(val))
    return torch.from_numpy(np.array(temp_list)).float()

# Seperating the labels from the rest of the data
train_labels = X_train['wo_embedding']
train_labels = label_tensor(train_labels)

test_labels = X_test['wo_embedding']
test_labels = label_tensor(test_labels)

val_labels = X_val['wo_embedding']
val_labels = label_tensor(val_labels)

X_train = X_train.drop(columns = ['wo_embedding', 'first_name', 'last_name'])
X_test = X_test.drop(columns = ['wo_embedding', 'first_name', 'last_name'])
X_val = X_val.drop(columns = ['wo_embedding', 'first_name', 'last_name'])

# Define scaler
scaler = StandardScaler()

# Scale applicable data
X_train = scaler.fit_transform(X_train)
X_val = scaler.transform(X_val)
X_test = scaler.transform(X_test)

# Test values scaled to csv
np.savetxt('./data/test_data.csv', X_test, delimiter=',', fmt='%.8f')

# Convert from numpy to tensors
X_train = torch.from_numpy(X_train).float()
X_val = torch.from_numpy(X_val).float()
X_test = torch.from_numpy(X_test).float()

# Bring them back togther after they are converted
X_train = data_utils.TensorDataset(X_train, train_labels)
X_val = data_utils.TensorDataset(X_val, val_labels)
X_test = data_utils.TensorDataset(X_test, test_labels)

# Define data loaders
batch_size = 16
train_loader = DataLoader(X_train, shuffle=True, batch_size=batch_size)
val_loader = DataLoader(X_val, shuffle=True, batch_size=batch_size)
test_loader = DataLoader(X_test, shuffle=True, batch_size=batch_size)

# Define the model
class WorkoutNet(nn.Module):
    def __init__(self):
        super(WorkoutNet, self).__init__()
        # Encoding Layers
        self.fc1 = nn.Linear(42, 64, device=device)
        self.fc2 = nn.Linear(64, 32, device=device)

        # Output Layer
        self.fc6 = nn.Linear(32, 1003, device=device)

        # Regularization layers
        self.dropout = nn.Dropout(p=0.3)

    def forward(self, x):
    #def forward(self, x, p):
        x = torch.relu(self.fc1(x))
        x = self.dropout(x)
        x = torch.relu(self.fc2(x))
        x = self.dropout(x)
        x = self.fc6(x)

        # Return output for training and logits layer
        return torch.sigmoid(x), x

# Initialize the model and move it to GPU
model = WorkoutNet().to(device)

# Define loss function and optimizer
criterion = nn.BCELoss()
optimizer = optim.Adam(model.parameters(), lr=0.0001)

# Training loop
# Number of epochs to train the model
n_epochs = 10
train_losses = []
val_losses = []

# Training loop for model.
for epoch in range(1, n_epochs+1):
    # Training loop 
    model.train()
    train_loss = 0.0
    for data, labels in train_loader:
        data = data.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()

        output, _ = model(data)
        loss = criterion(output, labels)
        train_loss += loss.item()

        loss.backward()
        optimizer.step()

    train_losses.append(train_loss/len(train_loader))

    # Validation loop
    model.eval()
    val_loss = 0.0
    with torch.no_grad():
        for data, labels in val_loader:
            data = data.to(device)
            labels = labels.to(device)
            output, _ = model(data)
            loss = criterion(output,labels)
            val_loss += loss.item()
    val_losses.append(val_loss/len(val_loader))      

    # Print avg training statistics 
    print('Epoch: {} \tTraining Loss: {:.6f} \tValidation Loss: {:.6f}'.format(
        epoch, 
        train_loss/len(train_loader),
        val_loss/len(val_loader)))

# Save final model parameters
torch.save(model.state_dict(), 'final_model.pth')